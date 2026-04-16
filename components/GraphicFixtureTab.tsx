"use client"

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Download,
  Upload,
  LayoutTemplate,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Plus,
  GripVertical,
  X,
} from "lucide-react"
import { useAppContext } from "@/context/AppContext"

interface FixtureSource {
  id: string
  league?: string
  date?: string
  time?: string
  leagueColor?: string
  textColor?: string
  dateTextColor?: string
  homeTeam?: {
    name?: string
    logo?: string
  }
  awayTeam?: {
    name?: string
    logo?: string
  }
  times?: Record<string, string>
}

interface TimeZoneSource {
  name?: string
  label?: string
  enabled?: boolean
}

interface LeagueSource {
  name: string
  color: string
  gradient?: {
    enabled: boolean
    startColor: string
    endColor: string
    direction: "to right" | "to left" | "to top" | "to bottom"
  }
}

interface GraphicFixtureTabProps {
  fixturesOverride?: FixtureSource[]
  timeZonesOverride?: TimeZoneSource[]
  leaguesOverride?: LeagueSource[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface GfxRow {
  id: string
  dateHeader?: string
  homeTeam: string
  homeTeamLogo: string
  awayTeam: string
  awayTeamLogo: string
  col1: string
  col2: string
  col3: string
}

export interface GfxData {
  league: string
  language: "es" | "pt-BR"
  mainImage: string
  title: string
  col1Label: string
  col2Label: string
  col3Label: string
  showCol3: boolean
  showTeamNames: boolean
  useWhiteLogo?: boolean
  rows: GfxRow[]
}

interface GraphicLeagueTheme {
  bandBackground: string
  dark: string
  textColor: string
  dateTextColor: string
}

interface GraphicSection {
  league: string
  data: GfxData
  theme: GraphicLeagueTheme
  layoutMode: "teams" | "times"
  imageTransform: ImageTransform
}

export interface ImageTransform {
  x: number
  y: number
  scale: number
}

const DEFAULT_IMAGE_TRANSFORM: ImageTransform = { x: 0, y: 0, scale: 1 }
export const GRAPHIC_STATE_STORAGE_KEY = "fixture-generator-graphic-state-v1"

interface PersistedGraphicState {
  version: number
  league: string
  language: GfxData["language"]
  selectedLeagues: string[]
  leagueImages: Record<string, string>
  leagueTransforms: Record<string, ImageTransform>
  leagueLogoVariants: Record<string, boolean>
}

const isImageTransform = (value: unknown): value is ImageTransform => {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<ImageTransform>
  return typeof candidate.x === "number" && typeof candidate.y === "number" && typeof candidate.scale === "number"
}

const toStringRecord = (value: unknown) => {
  if (!value || typeof value !== "object") return {}

  const record: Record<string, string> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "string" && entry) {
      record[key] = entry
    }
  }

  return record
}

const toTransformRecord = (value: unknown) => {
  if (!value || typeof value !== "object") return {}

  const record: Record<string, ImageTransform> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (isImageTransform(entry)) {
      record[key] = entry
    }
  }

  return record
}

const toBooleanRecord = (value: unknown) => {
  if (!value || typeof value !== "object") return {}

  const record: Record<string, boolean> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "boolean") {
      record[key] = entry
    }
  }

  return record
}

// ─────────────────────────────────────────────────────────────────────────────
// League config
// Place league background at: /public/gfx/backgrounds/<slug>.jpg
// Place league logo at:       /public/gfx/logos/<slug>.png
// Optional white logo at:     /public/gfx/logos/<name> Blanco.png
// ─────────────────────────────────────────────────────────────────────────────

interface LeagueCfg {
  color: string
  dark: string
}

interface LeagueAssets {
  logo?: string
  whiteLogo?: string
  background?: string
}

const LEAGUE_CFG: Record<string, LeagueCfg> = {
  Euroliga:          { color: "#ff6b00", dark: "#000000" },
  Endesa:            { color: "#cc1f00", dark: "#1a0000" },
  U22:               { color: "#3a52a0", dark: "#080e20" },
  NBB:               { color: "#d49510", dark: "#1a1000" },
  "Liga Ouro":       { color: "#006030", dark: "#001508" },
  "Liga Nacional":   { color: "#5e0b11", dark: "#1a0005" },
  "Liga Argentina":  { color: "#02303b", dark: "#001a28" },
  "Primera FEB":     { color: "#dd1a22", dark: "#1a0003" },
  "Liga Femenina":   { color: "#ff00db", dark: "#120020" },
  LUB:               { color: "#2298c8", dark: "#001a2e" },
  "Liga Chery":      { color: "#a0803c", dark: "#1a1008" },
  "Liga Dos":        { color: "#787878", dark: "#141414" },
  Libo:              { color: "#007800", dark: "#001800" },
  "Liga Ecuador":    { color: "#c8b800", dark: "#1a1500" },
  "Ecuador Femenino": { color: "#ff40ff", dark: "#1a001a" },
  "Liga Nacional Femenina Chile": { color: "#002244", dark: "#001122" },
  Italia:            { color: "#a00620", dark: "#1a0005" },
  Proximo:           { color: "#223600", dark: "#0a1200" },
}

const LEAGUE_ASSETS: Record<string, LeagueAssets> = {
  Euroliga:        { logo: "/gfx/logos/Euroliga.png", whiteLogo: "/gfx/logos/Euroliga Blanco.png", background: "/gfx/backgrounds/FondoEuroliga.png" },
  Endesa:          { logo: "/gfx/logos/Liga Endesa.png", whiteLogo: "/gfx/logos/Liga Endesa Blanco.png", background: "/gfx/backgrounds/FondoLigaEndesa.png" },
  U22:             { logo: "/gfx/logos/Liga U22.png", whiteLogo: "/gfx/logos/Liga U22 Blanco.png", background: "/gfx/backgrounds/FondoU22.png" },
  "Liga Nacional": { logo: "/gfx/logos/Liga Nacional.png", background: "/gfx/backgrounds/FondoLigaNacional.png" },
  "Liga Argentina": { logo: "/gfx/logos/Liga Argentina.png", background: "/gfx/backgrounds/FondoLigaArgentina.png" },
  "Primera FEB":   { logo: "/gfx/logos/Primera FEB.png", whiteLogo: "/gfx/logos/Primera Blanco.png", background: "/gfx/backgrounds/FondoPrimeraFeb.png" },
  "Liga Femenina": { logo: "/gfx/logos/Liga Femenina.png", background: "/gfx/backgrounds/FondoLigaFemenina.png" },
  LUB:             { logo: "/gfx/logos/LUB.png", background: "/gfx/backgrounds/FondoUruguayLub.png" },
  "Liga Chery":    { logo: "/gfx/logos/Liga Chery.png", background: "/gfx/backgrounds/FondoChery.png" },
  "Liga Dos":      { logo: "/gfx/logos/Liga Dos.png" },
  Libo:            { logo: "/gfx/logos/Libo Basquet.png" },
  "Liga Ecuador":  { background: "/gfx/backgrounds/FondoEcuMas.png" },
  "Ecuador Femenino": { logo: "/gfx/logos/LBP Femenina.png", background: "/gfx/backgrounds/FondoEcufem.png" },
  "Liga Nacional Femenina Chile": { logo: "/gfx/logos/LNF Chile.png", background: "/gfx/backgrounds/FondoLigaNacionalChilenaFemenina.png" },
  Italia:          { logo: "/gfx/logos/LBA SeriE A.png", background: "/gfx/backgrounds/FondoLigaItalia.png" },
  Proximo:         { logo: "/gfx/logos/Liga Proximo.png", background: "/gfx/backgrounds/FondoLigaProximo.png" },
}

const LEAGUES = Object.keys(LEAGUE_CFG)

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const slugify = (s: string) =>
  s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")

const getLeagueAssets = (league: string, useWhiteLogo = false) => {
  const slug = slugify(league)
  const mapped = LEAGUE_ASSETS[league] ?? {}
  const defaultLogo = mapped.logo ?? `/gfx/logos/${slug}.png`
  const whiteLogo = mapped.whiteLogo ?? ""

  return {
    logo: useWhiteLogo && whiteLogo ? whiteLogo : defaultLogo,
    background: mapped.background ?? `/gfx/backgrounds/${slug}.jpg`,
    whiteLogo,
  }
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader()
    r.onload  = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(file)
  })

const DEFAULT_DATA: GfxData = {
  league:      "Euroliga",
  language:    "es",
  mainImage:   "",
  title:       "",
  col1Label:   "ECU",
  col2Label:   "BOL / CHI",
  col3Label:   "ARG / BRA",
  showCol3:    false,
  showTeamNames: false,
  rows: [],
}

const getActiveTimeZones = (timeZones: TimeZoneSource[]) => timeZones.filter((tz) => tz.enabled !== false)

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const hasParentheticalTeamTag = (name: string) => /\([^)]+\)/.test(name)

const GRAPHIC_PREVIEW_LEAGUE_ORDER = [
  "Liga Nacional",
  "Liga Argentina",
  "Liga Femenina",
  "Euroliga",
  "Endesa",
  "Primera FEB",
  "U22",
  "Italia",
  "LUB",
  "Liga Chery",
  "Liga Dos",
  "Liga Nacional Femenina",
  "Liga Nacional Femenina Chile",
  "Ecuador Femenino",
]

const sortPreviewLeagues = (leagues: string[]) => {
  const unique = Array.from(
    new Set(
      leagues
        .map((league) => league.trim())
        .filter((league) => league.length > 0),
    ),
  )
  const priority = new Map(GRAPHIC_PREVIEW_LEAGUE_ORDER.map((league, index) => [league, index]))

  return unique
    .map((league, originalIndex) => ({ league, originalIndex }))
    .sort((a, b) => {
      const aPriority = priority.has(a.league) ? priority.get(a.league)! : Number.MAX_SAFE_INTEGER
      const bPriority = priority.has(b.league) ? priority.get(b.league)! : Number.MAX_SAFE_INTEGER

      if (aPriority !== bPriority) return aPriority - bPriority
      return a.originalIndex - b.originalIndex
    })
    .map(({ league }) => league)
}

const shouldSplitTeamWords = (words: string[]) => {
  if (words.length <= 1) return false
  const firstLen = words[0]?.length ?? 0
  const firstTwoLen = (words[0]?.length ?? 0) + (words[1]?.length ?? 0)
  return firstLen > 8 || firstTwoLen > 8
}

const normalizeTeamName = (name: string) => name.trim().normalize("NFC").replace(/\s+/g, " ")

const getTeamNameLines = (name: string, allowSplit: boolean, allowShortLayoutOverrides: boolean) => {
  const normalizedName = normalizeTeamName(name)
  const lowerName = normalizedName.toLowerCase()

  if (allowSplit && allowShortLayoutOverrides) {
    if (lowerName === "dragonas importadora alvarado") {
      return ["Dragonas", "Importadora", "Alvarado"]
    }
    if (lowerName === "san pablo burgos") {
      return ["San Pablo", "Burgos"]
    }
  }

  if (hasParentheticalTeamTag(normalizedName)) return [normalizedName]
  if (!allowSplit) return [normalizedName]

  const words = normalizedName.split(/\s+/).filter(Boolean)
  if (!shouldSplitTeamWords(words)) return [normalizedName]
  return words.length >= 3 ? [words.slice(0, 2).join(" "), words.slice(2).join(" ")] : [words[0], words.slice(1).join(" ")]
}

const getFiveMatchTeamNameNudge = (name: string, bandHeight: number) => {
  const normalizedName = normalizeTeamName(name)
  const lowerName = normalizedName.toLowerCase()
  const singleWordNudge = Math.round(bandHeight * 0.10)

  if (!normalizedName) return 0
  if (lowerName === "quimsa") return singleWordNudge + Math.round(bandHeight * 0.07)
  if (hasParentheticalTeamTag(normalizedName)) return singleWordNudge
  if (normalizedName.split(/\s+/).filter(Boolean).length === 1) return singleWordNudge
  return 0
}

const escapeSvgText = (value: string) =>
  Array.from(value.normalize("NFC"))
    .map((char) => {
      switch (char) {
        case "&":
          return "&amp;"
        case "<":
          return "&lt;"
        case ">":
          return "&gt;"
        case '"':
          return "&quot;"
        case "'":
          return "&apos;"
        default: {
          const codePoint = char.codePointAt(0) ?? 0
          return codePoint > 127 ? `&#x${codePoint.toString(16).toUpperCase()};` : char
        }
      }
    })
    .join("")

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

const fetchAssetAsDataUrl = async (src?: string, cache?: Map<string, string>) => {
  if (!src) return ""
  if (src.startsWith("data:")) return src

  const absoluteUrl = /^https?:\/\//.test(src) ? src : new URL(src, window.location.origin).toString()
  if (cache?.has(absoluteUrl)) return cache.get(absoluteUrl) ?? ""

  try {
    const response = await fetch(absoluteUrl)
    if (!response.ok) return absoluteUrl
    const dataUrl = await blobToDataUrl(await response.blob())
    cache?.set(absoluteUrl, dataUrl)
    return dataUrl
  } catch {
    return absoluteUrl
  }
}

const hexToRgb = (value: string) => {
  const normalized = normalizeHexColor(value)
  if (!normalized) return { r: 0, g: 0, b: 0 }
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  }
}

const parseSvgLinearGradient = (value: string, id: string) => {
  const match = value.match(/^linear-gradient\(([^,]+),\s*([^,]+),\s*([^)]+)\)$/)
  if (!match) return null

  const direction = match[1].trim()
  const start = match[2].trim()
  const end = match[3].trim()
  let coords = { x1: "0%", y1: "0%", x2: "100%", y2: "0%" }

  if (direction === "to bottom") coords = { x1: "0%", y1: "0%", x2: "0%", y2: "100%" }
  if (direction === "to top") coords = { x1: "0%", y1: "100%", x2: "0%", y2: "0%" }
  if (direction === "to left") coords = { x1: "100%", y1: "0%", x2: "0%", y2: "0%" }

  return {
    fill: `url(#${id})`,
    def: `<linearGradient id="${id}" x1="${coords.x1}" y1="${coords.y1}" x2="${coords.x2}" y2="${coords.y2}"><stop offset="0%" stop-color="${start}" /><stop offset="100%" stop-color="${end}" /></linearGradient>`,
  }
}

const dividerSvgColor = (textColor: string) =>
  textColor === "#111111" ? "#111111" : "#ffffff"

const normalizeHexColor = (value?: string) => {
  if (!value) return null
  const color = value.trim()
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return null
  return color
}

const darkenHex = (value: string, amount = 0.55) => {
  const color = normalizeHexColor(value)
  if (!color) return "#000000"

  const mix = (channel: number) => Math.round(channel * (1 - amount))
  const r = mix(parseInt(color.slice(1, 3), 16))
  const g = mix(parseInt(color.slice(3, 5), 16))
  const b = mix(parseInt(color.slice(5, 7), 16))

  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`
}

const parseFixtureDate = (value?: string) => {
  if (!value) return null
  const [dayStr, monthStr, yearStr] = value.split(/[/-]/)
  const day = Number(dayStr)
  const month = Number(monthStr)
  const year = Number(yearStr) || new Date().getFullYear()
  if (!day || !month || month < 1 || month > 12) return null
  const parsed = new Date(year, month - 1, day)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const parseFixtureMinutes = (value?: string) => {
  if (!value) return Number.POSITIVE_INFINITY
  const [hoursStr, minutesStr] = value.split(":")
  const hours = Number(hoursStr)
  const minutes = Number(minutesStr)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return Number.POSITIVE_INFINITY
  return hours * 60 + minutes
}

const sortFixturesForGraphic = (fixtures: FixtureSource[]) =>
  [...fixtures].sort((a, b) => {
    const dateA = parseFixtureDate(a.date)
    const dateB = parseFixtureDate(b.date)

    if (dateA && dateB && dateA.getTime() !== dateB.getTime()) {
      return dateA.getTime() - dateB.getTime()
    }

    if (dateA && !dateB) return -1
    if (!dateA && dateB) return 1

    const minutesA = parseFixtureMinutes(a.time ?? a.times?.ECU)
    const minutesB = parseFixtureMinutes(b.time ?? b.times?.ECU)
    if (minutesA !== minutesB) {
      return minutesA - minutesB
    }

    return (a.homeTeam?.name ?? "").localeCompare(b.homeTeam?.name ?? "")
  })

const getGraphicLeagueTheme = (league: string, fixtures: FixtureSource[], leagues: LeagueSource[]): GraphicLeagueTheme => {
  const cfg = LEAGUE_CFG[league] ?? { color: "#ff6b00", dark: "#000000" }
  const leagueCfg = leagues.find((item) => item.name === league)
  const sampleFixture = fixtures.find((item) => item.league === league)
  const fallbackColor = normalizeHexColor(sampleFixture?.leagueColor) ?? normalizeHexColor(leagueCfg?.color) ?? cfg.color
  const preferredBandColor =
    league === "Liga Nacional Femenina Chile"
      ? normalizeHexColor(leagueCfg?.color) ?? cfg.color
      : fallbackColor
  const gradientStart = normalizeHexColor(leagueCfg?.gradient?.startColor) ?? preferredBandColor
  const dark =
    league === "Liga Nacional Femenina Chile"
      ? cfg.dark ?? darkenHex(preferredBandColor, 0.6)
      : leagueCfg?.gradient?.enabled
        ? darkenHex(gradientStart, 0.6)
        : darkenHex(fallbackColor, 0.6)
  const dateTextColor =
    league === "U22" || sampleFixture?.dateTextColor === "black"
      ? "#111111"
      : "#ffffff"

  return {
    bandBackground: leagueCfg?.gradient?.enabled
      ? `linear-gradient(${leagueCfg.gradient.direction}, ${leagueCfg.gradient.startColor}, ${leagueCfg.gradient.endColor})`
      : preferredBandColor,
    dark,
    textColor: sampleFixture?.textColor === "black" ? "#111111" : "#ffffff",
    dateTextColor,
  }
}

const buildGraphicDataFromFixtures = ({
  fixtures,
  timeZones,
  league,
  language,
}: {
  fixtures: FixtureSource[]
  timeZones: TimeZoneSource[]
  league: string
  language: GfxData["language"]
}) => {
  const matches = sortFixturesForGraphic(fixtures.filter((m) => m.league === league))
  if (matches.length === 0) return null

  const activeTZs = getActiveTimeZones(timeZones)
  let previousDateKey = ""
  const rows: GfxRow[] = matches.slice(0, 6).map((m, index) => {
    const currentDateKey = m.date ?? ""
    const row: GfxRow = {
      id: m.id,
      homeTeam: m.homeTeam?.name ?? "",
      homeTeamLogo: m.homeTeam?.logo ?? "",
      awayTeam: m.awayTeam?.name ?? "",
      awayTeamLogo: m.awayTeam?.logo ?? "",
      col1: m.times?.[activeTZs[0]?.name ?? ""] ?? m.times?.ECU ?? "",
      col2: m.times?.[activeTZs[1]?.name ?? ""] ?? m.times?.BOL ?? "",
      col3: m.times?.[activeTZs[2]?.name ?? ""] ?? m.times?.ARG ?? "",
    }

    if (index > 0 && currentDateKey && currentDateKey !== previousDateKey) {
      row.dateHeader = generateTitleFromDate(currentDateKey, language)
    }

    previousDateKey = currentDateKey
    return row
  })

  return {
    rows,
    title: generateTitleFromDate(matches[0]?.date ?? "", language),
    col1Label: activeTZs[0]?.label ?? DEFAULT_DATA.col1Label,
    col2Label: activeTZs[1]?.label ?? DEFAULT_DATA.col2Label,
    col3Label: activeTZs[2]?.label ?? DEFAULT_DATA.col3Label,
    showCol3: activeTZs.length >= 3,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Title auto-generation from fixture date  (e.g. "10/4" → "viernes 10 de abril")
// ─────────────────────────────────────────────────────────────────────────────

const ES_DAYS   = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"]
const PT_DAYS   = ["domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado"]
const ES_MONTHS = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]
const PT_MONTHS = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"]

function generateTitleFromDate(dateStr: string, lang: "es" | "pt-BR"): string {
  if (!dateStr) return ""
  const parts  = dateStr.split(/[/-]/).map((p) => parseInt(p, 10))
  const day    = parts[0]
  const month  = parts[1]
  if (!day || !month || month < 1 || month > 12) return ""
  const year   = parts[2] ?? new Date().getFullYear()
  const date   = new Date(year, month - 1, day)
  const dow    = date.getDay()
  const title = lang === "es"
    ? `${ES_DAYS[dow]} ${day} de ${ES_MONTHS[month - 1]}`
    : `${PT_DAYS[dow]}, ${day} de ${PT_MONTHS[month - 1]}`

  return title.charAt(0).toUpperCase() + title.slice(1)
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas dimensions
// ─────────────────────────────────────────────────────────────────────────────

const CANVAS_W = 1858
const CANVAS_H = 731
const LEFT_W = 839
const RIGHT_W = CANVAS_W - LEFT_W
const CANVAS_RADIUS = 18
const COMPOSITE_SECTION_GAP = 26
const DATE_TITLE_FONT_SIZE = 26
const INLINE_DATE_FONT_SIZE = 26
const INLINE_DATE_HEIGHT = 34
const BOTTOM_PADDING = 40
const RIGHT_SIDE_PADDING = 25
const ROW_GAP = 12
const REFERENCE_ROW_HEIGHT = 110
const REFERENCE_LABEL_FONT_SIZE = 17
const REFERENCE_TIME_FONT_SIZE = 58
const SVG_EXPORT_FONT_FAMILY = "Poppins, sans-serif"
const SVG_EXPORT_POPPINS_400_URL = "/fonts/Poppins-400-latin.woff2"
const SVG_EXPORT_POPPINS_700_URL = "/fonts/Poppins-700-latin.woff2"
const SVG_EXPORT_TEXT_ATTRS = `font-family="${SVG_EXPORT_FONT_FAMILY}" font-variant-ligatures="none" font-kerning="none" font-feature-settings="'liga' 0, 'clig' 0, 'calt' 0"`

// ─────────────────────────────────────────────────────────────────────────────
// CanvasRow — one fixture row rendered inside the right panel
// ─────────────────────────────────────────────────────────────────────────────

function CanvasRow({
  row, theme, rowH, rowCount, showTeamNames, showCol3, layoutMode,
  col1Label, col2Label, col3Label,
}: {
  row: GfxRow
  theme: GraphicLeagueTheme
  rowH: number
  rowCount: number
  showTeamNames: boolean
  showCol3: boolean
  layoutMode: "teams" | "times"
  col1Label: string
  col2Label: string
  col3Label: string
}) {
  const useShortSizing = rowCount <= 4
  const renderTeamsLayout = layoutMode === "teams" || showTeamNames
  const isCompactTeamsLayout = renderTeamsLayout && useShortSizing
  const effectiveRowH = useShortSizing
    ? Math.min(rowH, 150)
    : Math.min(rowH, REFERENCE_ROW_HEIGHT)
  const maxContentHeight = Math.max(72, effectiveRowH - 4)
  const bandHeight = useShortSizing
    ? Math.min(101, maxContentHeight)
    : Math.min(
        clamp(Math.floor(effectiveRowH * 0.78), 70, Math.min(118, maxContentHeight)),
      )
  const isFiveMatchLayout = rowCount === 5
  const logoBoxSize = useShortSizing
    ? clamp(Math.ceil(132 * 1.1), 96, Math.min(174, maxContentHeight))
    : clamp(Math.ceil(bandHeight * (isFiveMatchLayout ? 1.65 : 1.32) * 1.1), 90, Math.min(174, maxContentHeight))
  const fiveMatchLogoScale = 1.118
  const screenLogoBoxScale = 1.104
  const fiveMatchLogoBoxMax = Math.min(210, maxContentHeight * 1.08)
  const fiveMatchLogoBoxWidthScale = 0.972
  const fiveMatchLogoBoxHeightScale = 0.847875
  const adjustedLogoBoxSize = isFiveMatchLayout
    ? clamp(Math.ceil(bandHeight * 1.65 * 1.1 * fiveMatchLogoScale * screenLogoBoxScale), 90, fiveMatchLogoBoxMax)
    : logoBoxSize
  const finalLogoBoxSize = adjustedLogoBoxSize
  const finalLogoBoxHeight = isFiveMatchLayout
    ? Math.max(90, Math.round(adjustedLogoBoxSize * fiveMatchLogoBoxHeightScale))
    : logoBoxSize
  const logoSize = Math.floor(Math.min(finalLogoBoxSize, finalLogoBoxHeight) * (isFiveMatchLayout ? 0.88 * 1.15 * 0.95 : 0.8))
  const labelFz = REFERENCE_LABEL_FONT_SIZE
  const timeFz = REFERENCE_TIME_FONT_SIZE
  const bandNameFz = isCompactTeamsLayout ? 27 : clamp(Math.floor(bandHeight * 0.32), 24, 42)
  const centeredTimeFz = REFERENCE_TIME_FONT_SIZE
  const teamTimeValue = row.col2 || row.col1 || row.col3 || "--:--"
  const shouldSplitTeamName = renderTeamsLayout && rowCount <= 5
  const homeNameOffset = isCompactTeamsLayout
    ? row.homeTeam.trim().length <= 12
      ? "translateY(12px)"
      : undefined
    : isFiveMatchLayout
      ? `translateY(${getFiveMatchTeamNameNudge(row.homeTeam, bandHeight)}px)`
      : undefined
  const awayNameOffset = isCompactTeamsLayout
    ? row.awayTeam.trim().length <= 12
      ? "translateY(12px)"
      : undefined
    : isFiveMatchLayout
      ? `translateY(${getFiveMatchTeamNameNudge(row.awayTeam, bandHeight)}px)`
      : undefined
  const renderTeamName = (name: string) => {
    const lines = getTeamNameLines(name, shouldSplitTeamName, rowCount <= 4)
    if (lines.length === 1) return lines[0]

    return (
      <>
        {lines.map((line, index) => (
          <span key={`${line}-${index}`} style={{ display: "block", whiteSpace: "nowrap" }}>
            {line}
          </span>
        ))}
      </>
    )
  }
  const cols     = [
    { label: col1Label, val: row.col1 },
    { label: col2Label, val: row.col2 },
    ...(showCol3 ? [{ label: col3Label, val: row.col3 }] : []),
  ]

  return (
    <div style={{
      height: rowH,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 0,
      boxSizing: "border-box",
    }}>
      <div style={{
        width: finalLogoBoxSize,
        height: finalLogoBoxHeight,
        background: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}>
        {row.homeTeamLogo ? (
          <img
            src={row.homeTeamLogo}
            crossOrigin="anonymous"
            style={{ width: logoSize, height: logoSize, objectFit: "contain" }}
            alt=""
          />
        ) : (
          <div style={{ width: logoSize, height: logoSize, borderRadius: 10, background: "#e5e7eb" }} />
        )}
      </div>

      <div style={{
        flex: 1,
        height: bandHeight,
        background: theme.bandBackground,
        display: "flex",
        alignItems: "stretch",
        justifyContent: "space-between",
        color: theme.textColor,
        flexShrink: 1,
      }}>
        {renderTeamsLayout ? (
          <>
            <div style={{
              flex: 1,
              display: "flex",
              alignItems: isCompactTeamsLayout ? "flex-start" : "center",
              justifyContent: "center",
              padding: isCompactTeamsLayout ? "10px 12px 0" : "0 20px",
              boxSizing: "border-box",
            }}>
              <span style={{
                color: theme.textColor,
                fontSize: bandNameFz,
                fontWeight: 400,
                lineHeight: 1.02,
                textAlign: "center",
                whiteSpace: "normal",
                overflowWrap: "break-word",
                textWrap: "balance",
                transform: homeNameOffset,
              }}>
                {renderTeamName(row.homeTeam)}
              </span>
            </div>
            <div style={{
              width: 2,
              alignSelf: "center",
              height: "76%",
              background: theme.textColor === "#111111" ? "rgba(17,17,17,0.82)" : "rgba(255,255,255,0.9)",
              flexShrink: 0,
            }} />
            <div style={{
              flex: 1,
              display: "flex",
              alignItems: isCompactTeamsLayout ? "flex-start" : "center",
              justifyContent: "center",
              padding: isCompactTeamsLayout ? "6px 10px 0" : "0 16px",
              boxSizing: "border-box",
            }}>
                <span style={{
                  color: theme.textColor,
                  fontSize: centeredTimeFz,
                  fontWeight: 700,
                  lineHeight: 1,
                  transform: isCompactTeamsLayout ? "translateY(-8px)" : undefined,
                }}>
                {teamTimeValue}
              </span>
            </div>
            <div style={{
              width: 2,
              alignSelf: "center",
              height: "76%",
              background: theme.textColor === "#111111" ? "rgba(17,17,17,0.82)" : "rgba(255,255,255,0.9)",
              flexShrink: 0,
            }} />
            <div style={{
              flex: 1,
              display: "flex",
              alignItems: isCompactTeamsLayout ? "flex-start" : "center",
              justifyContent: "center",
              padding: isCompactTeamsLayout ? "10px 12px 0" : "0 20px",
              boxSizing: "border-box",
            }}>
              <span style={{
                color: theme.textColor,
                fontSize: bandNameFz,
                fontWeight: 400,
                lineHeight: 1.02,
                textAlign: "center",
                whiteSpace: "normal",
                overflowWrap: "break-word",
                textWrap: "balance",
                transform: awayNameOffset,
              }}>
                {renderTeamName(row.awayTeam)}
              </span>
            </div>
          </>
        ) : (
          cols.map(({ label, val }, index) => (
            <React.Fragment key={label}>
              <div style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-start",
                padding: `${Math.max(1, Math.floor(bandHeight * 0.02))}px 12px 0`,
                boxSizing: "border-box",
              }}>
                <span style={{
                  color: theme.textColor,
                  fontSize: labelFz,
                  fontWeight: 400,
                  letterSpacing: 0,
                  textTransform: "uppercase",
                  lineHeight: 1,
                  transform: isFiveMatchLayout ? "translateY(-5px)" : useShortSizing ? "translateY(-20px)" : "translateY(-10px)",
                }}>
                  {label}
                </span>
                <span style={{
                  color: theme.textColor,
                  fontSize: timeFz,
                  fontWeight: 700,
                  lineHeight: 0.92,
                  marginTop: 0,
                  transform: isFiveMatchLayout ? "translateY(-11px)" : useShortSizing ? "translateY(-24px)" : "translateY(-20px)",
                }}>
                  {val || "--:--"}
                </span>
              </div>
              {index < cols.length - 1 && (
                <div style={{
                  width: 2,
                  alignSelf: "center",
                  height: "76%",
                  background: theme.textColor === "#111111" ? "rgba(17,17,17,0.82)" : "rgba(255,255,255,0.9)",
                  flexShrink: 0,
                }} />
              )}
            </React.Fragment>
          ))
        )}
      </div>

      <div style={{
        width: finalLogoBoxSize,
        height: finalLogoBoxHeight,
        background: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}>
        {row.awayTeamLogo ? (
          <img
            src={row.awayTeamLogo}
            crossOrigin="anonymous"
            style={{ width: logoSize, height: logoSize, objectFit: "contain" }}
            alt=""
          />
        ) : (
          <div style={{ width: logoSize, height: logoSize, borderRadius: 10, background: "#e5e7eb" }} />
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// GfxCanvas — the actual 1858×731 graphic output
// ─────────────────────────────────────────────────────────────────────────────

export function GfxCanvas({
  data,
  theme,
  imageTransform = DEFAULT_IMAGE_TRANSFORM,
  layoutMode = "times",
}: {
  data: GfxData
  theme: GraphicLeagueTheme
  imageTransform?: ImageTransform
  layoutMode?: "teams" | "times"
}) {
  const assets = getLeagueAssets(data.league, data.useWhiteLogo ?? false)
  const rowCount = Math.max(1, data.rows.length)
  const dateBreakCount = data.rows.reduce((count, row) => count + (row.dateHeader ? 1 : 0), 0)
  const centerShortLayouts = rowCount <= 4
  const headerHeight = 0
  const bottomPadding = BOTTOM_PADDING
  const sidePadding = RIGHT_SIDE_PADDING
  const rowGap = data.rows.length > 1 ? (centerShortLayouts ? 12 : rowCount === 5 ? 8 : ROW_GAP) : 0
  const fiveMatchDateGap = rowCount === 5 ? 0 : rowGap
  const shortInterDateGap = centerShortLayouts ? 0 : rowGap
  const titleDateHeight = centerShortLayouts ? 28 : rowCount === 5 ? 26 : INLINE_DATE_HEIGHT
  const rowDateHeight = centerShortLayouts ? 28 : rowCount === 5 ? 26 : INLINE_DATE_HEIGHT
  const rowDateFontSize = INLINE_DATE_FONT_SIZE
  const shortDateTextOffset = centerShortLayouts ? Math.round(rowDateHeight * 0.5) : 0
  const topDateHeight = data.title ? titleDateHeight : 0
  const rowH = centerShortLayouts
    ? 152
    : Math.floor(
        (CANVAS_H - headerHeight - bottomPadding - rowGap * Math.max(0, rowCount - 1) - rowDateHeight * dateBreakCount - topDateHeight) / rowCount,
      )
  const leagueLogoHeight = 134
  const leagueLogoMaxWidth = 224
  const timelineItems = [
    ...(data.title ? [{ key: `title-${data.title}`, kind: "title" as const, text: data.title }] : []),
    ...data.rows.flatMap((row) => [
      ...(row.dateHeader ? [{ key: `date-${row.id}`, kind: "date" as const, text: row.dateHeader }] : []),
      { key: `row-${row.id}`, kind: "row" as const, row },
    ]),
  ]

  return (
    <div style={{
      width: CANVAS_W, height: CANVAS_H,
      display: "flex",
      fontFamily: "var(--font-poppins), Poppins, sans-serif",
      borderRadius: CANVAS_RADIUS,
      overflow: "hidden",
      flexShrink: 0,
      background: "#000000",
      position: "relative",
    }}>
      <div style={{
        width: LEFT_W,
        height: CANVAS_H,
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
        background: "#050505",
      }}>
        {data.mainImage ? (
          <>
            <div
              style={{
                position: "absolute",
                inset: 0,
                transformOrigin: "center center",
                transform: `translate(${imageTransform.x}px, ${imageTransform.y}px) scale(${imageTransform.scale})`,
                backgroundImage: `url(${data.mainImage})`,
                backgroundPosition: "center center",
                backgroundRepeat: "no-repeat",
                backgroundSize: "contain",
              }}
            />
            <div style={{
              position: "absolute",
              inset: 0,
              background: "none",
            }} />
          </>
        ) : (
          <div style={{
            position: "absolute",
            inset: 0,
            background: "#050505",
          }} />
        )}
        <div style={{
          position: "absolute",
          inset: 0,
          background: data.mainImage
            ? "none"
            : "none",
        }} />
        <div style={{ position: "absolute", top: 26, left: 24, zIndex: 1 }}>
          <img
            src={assets.logo}
            crossOrigin="anonymous"
            style={{ height: leagueLogoHeight, maxWidth: leagueLogoMaxWidth, objectFit: "contain", display: "block" }}
            alt={data.league}
            onError={(e) => {
              const img = e.target as HTMLImageElement
              img.style.display = "none"
              const fallback = img.nextElementSibling as HTMLElement | null
              if (fallback) fallback.style.display = "inline-block"
            }}
          />
          <div style={{
            display: "none",
            padding: "5px 12px",
            background: "rgba(0,0,0,0.6)",
            color: "#fff",
            borderRadius: 6,
            fontSize: 15,
            fontWeight: 700,
            textTransform: "uppercase",
          }}>
            {data.league}
          </div>
        </div>
      </div>

      <div style={{
        width: RIGHT_W,
        height: CANVAS_H,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        background: theme.dark,
      }}>
        <img
          src={assets.background}
          crossOrigin="anonymous"
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: RIGHT_W,
            height: CANVAS_H,
            objectFit: "none",
          }}
          alt=""
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
        />
        <div style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(155deg, ${theme.dark}e8 0%, ${theme.dark}b8 36%, rgba(255,255,255,0.06) 100%)`,
        }} />

        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 0,
          justifyContent: centerShortLayouts ? "center" : "flex-start",
          padding: centerShortLayouts
            ? `0 ${sidePadding}px 0`
            : `0 ${sidePadding}px ${bottomPadding}px`,
          boxSizing: "border-box",
          position: "relative",
          zIndex: 1,
        }}>
          {timelineItems.map((item, index) => {
            const previousItem = timelineItems[index - 1]
            const isShortDateTransition =
              centerShortLayouts &&
              ((previousItem?.kind === "row" && item.kind === "date") ||
                (previousItem?.kind === "date" && item.kind === "row"))
            const isTitleTransition = centerShortLayouts && previousItem?.kind === "title"
            const isFiveMatchDateTransition = rowCount === 5 && previousItem?.kind === "row" && item.kind === "date"
            const itemGap =
              index === 0
                ? 0
                : isShortDateTransition || isTitleTransition
                  ? shortInterDateGap
                  : isFiveMatchDateTransition
                    ? fiveMatchDateGap
                    : rowGap
            const isTitleItem = item.kind === "title"

            if (item.kind === "date" || item.kind === "title") {
              const blockHeight = isTitleItem ? titleDateHeight : rowDateHeight
              const fontSize = isTitleItem ? INLINE_DATE_FONT_SIZE : rowDateFontSize
              return (
                <div
                  key={item.key}
                  style={{
                    height: blockHeight,
                    marginTop: itemGap,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <span style={{
                    color: theme.dateTextColor,
                    fontSize,
                    fontWeight: 700,
                    lineHeight: 1,
                    textAlign: "center",
                    transform: centerShortLayouts ? `translateY(${shortDateTextOffset}px)` : "translateY(2px)",
                  }}>
                    {item.text}
                  </span>
                </div>
              )
            }

            return (
              <div
                key={item.key}
                style={{
                  marginTop: itemGap,
                  flexShrink: 0,
                }}
              >
                <CanvasRow
                  row={item.row}
                  theme={theme}
                  rowH={rowH}
                  rowCount={rowCount}
                  showTeamNames={data.showTeamNames}
                  showCol3={data.showCol3}
                  layoutMode={layoutMode}
                  col1Label={data.col1Label}
                  col2Label={data.col2Label}
                  col3Label={data.col3Label}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function GfxCompositeCanvas({
  sections,
}: {
  sections: GraphicSection[]
}) {
  return (
    <div
      style={{
        width: CANVAS_W,
        height: Math.max(1, sections.length) * CANVAS_H + Math.max(0, sections.length - 1) * COMPOSITE_SECTION_GAP,
        display: "flex",
        flexDirection: "column",
        gap: COMPOSITE_SECTION_GAP,
        background: "#000000",
      }}
    >
      {sections.map((section, index) => (
        <div key={`${section.league}-${index}`} style={{ width: CANVAS_W, height: CANVAS_H, flex: "0 0 auto" }}>
          <GfxCanvas
            data={section.data}
            theme={section.theme}
            imageTransform={section.imageTransform}
            layoutMode={section.layoutMode}
          />
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main tab component
// ─────────────────────────────────────────────────────────────────────────────

export default function GraphicFixtureTab({
  fixturesOverride,
  timeZonesOverride,
  leaguesOverride,
}: GraphicFixtureTabProps) {
  const appContext = useAppContext()
  const fixtures = fixturesOverride ?? (appContext.fixtures as FixtureSource[])
  const timeZones = timeZonesOverride ?? (appContext.timeZones as TimeZoneSource[])
  const leagues = leaguesOverride ?? ((appContext.leagues as LeagueSource[]) ?? [])

  const [data, setData]           = useState<GfxData>(DEFAULT_DATA)
  const [selectedLeagues, setSelectedLeagues] = useState<string[]>([DEFAULT_DATA.league])
  const [leagueImages, setLeagueImages] = useState<Record<string, string>>({})
  const [leagueTransforms, setLeagueTransforms] = useState<Record<string, ImageTransform>>({})
  const [leagueLogoVariants, setLeagueLogoVariants] = useState<Record<string, boolean>>({})
  const [draggedPreviewLeague, setDraggedPreviewLeague] = useState<string | null>(null)
  const [previewDropTarget, setPreviewDropTarget] = useState<{ league: string; position: "before" | "after" } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isGraphicStateHydrated, setIsGraphicStateHydrated] = useState(false)
  const [exporting, setExporting]   = useState<"png" | "svg" | null>(null)
  const [loadMsg, setLoadMsg]       = useState<string | null>(null)
  const activeUsesWhiteLogo = leagueLogoVariants[data.league] ?? false
  const activeBaseAssets = getLeagueAssets(data.league)
  const activeAssets = getLeagueAssets(data.league, activeUsesWhiteLogo)
  const activeMainImage = leagueImages[data.league] ?? ""
  const activeImgTransform = leagueTransforms[data.league] ?? DEFAULT_IMAGE_TRANSFORM
  const activeTheme = useMemo(
    () => getGraphicLeagueTheme(data.league, fixtures, leagues),
    [data.league, fixtures, leagues],
  )
  const allFixtureLeagues = useMemo(() => {
    const unique = new Set<string>()
    fixtures.forEach((fixture) => {
      const league = fixture.league?.trim()
      if (league) unique.add(league)
    })
    return Array.from(unique)
  }, [fixtures])
  const visibleLeagueOptions = allFixtureLeagues
  const graphicSections = useMemo(() => {
    const orderedLeagues = selectedLeagues.length > 0 ? selectedLeagues : [data.league]
    const isSingleLeague = orderedLeagues.length === 1
    const syncedSections = orderedLeagues
      .map((league) => {
        const synced = buildGraphicDataFromFixtures({
          fixtures,
          timeZones,
          league,
          language: data.language,
        })
        if (!synced) return null

        return {
          league,
          theme: getGraphicLeagueTheme(league, fixtures, leagues),
          synced,
        }
      })
      .filter((section): section is { league: string; theme: GraphicLeagueTheme; synced: NonNullable<ReturnType<typeof buildGraphicDataFromFixtures>> } => section !== null)

    const globalLayoutMode: "teams" | "times" = data.showTeamNames ? "teams" : "times"

    return syncedSections
      .map((section) => ({
        league: section.league,
        theme: section.theme,
        layoutMode: globalLayoutMode,
        imageTransform: leagueTransforms[section.league] ?? DEFAULT_IMAGE_TRANSFORM,
        data: {
            ...data,
            league: section.league,
            useWhiteLogo: leagueLogoVariants[section.league] ?? false,
            mainImage: leagueImages[section.league] ?? "",
            title: isSingleLeague ? (data.title || section.synced.title) : section.synced.title,
            rows: section.synced.rows,
            showCol3: data.showCol3 && section.synced.showCol3,
            col1Label: data.col1Label,
            col2Label: data.col2Label,
            col3Label: data.col3Label,
          },
        } satisfies GraphicSection))
  }, [data, fixtures, leagueImages, leagueLogoVariants, leagueTransforms, leagues, selectedLeagues, timeZones])
  const compositeHeight =
    Math.max(1, graphicSections.length) * CANVAS_H +
    Math.max(0, graphicSections.length - 1) * COMPOSITE_SECTION_GAP

  // ── Image pan/zoom ─────────────────────────────────────────────────────────
  const [previewScale, setPreviewScale] = useState(0.5)
  const dragRef = useRef<{ startX: number; startY: number; startImgX: number; startImgY: number } | null>(null)

  // ── Refs ───────────────────────────────────────────────────────────────────
  const mainInputRef       = useRef<HTMLInputElement>(null)
  const previewContainerRef = useRef<HTMLDivElement>(null)

  // ── ResizeObserver: compute preview scale from container width ─────────────
  useEffect(() => {
    const el = previewContainerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setPreviewScale(el.clientWidth / CANVAS_W)
    })
    ro.observe(el)
    setPreviewScale(el.clientWidth / CANVAS_W)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!isGraphicStateHydrated) return
    if (visibleLeagueOptions.length === 0) return
    if (visibleLeagueOptions.includes(data.league)) return
    const fallbackLeague = sortPreviewLeagues(visibleLeagueOptions)[0] ?? data.league

    setData((current) => ({
      ...current,
      league: fallbackLeague,
    }))
  }, [data.league, isGraphicStateHydrated, visibleLeagueOptions])

  useEffect(() => {
    setSelectedLeagues((prev) => (prev.length === 1 ? [data.league] : prev))
  }, [data.league])

  useEffect(() => {
    if (!isGraphicStateHydrated) return
    if (allFixtureLeagues.length === 0) return

    setSelectedLeagues((prev) => {
      const next = prev.filter((league) => allFixtureLeagues.includes(league))
      if (next.length === prev.length && next.every((league, index) => league === prev[index])) {
        return prev
      }
      if (next.length > 0) {
        return sortPreviewLeagues(next)
      }
      return [sortPreviewLeagues(visibleLeagueOptions)[0] ?? data.league]
    })
  }, [allFixtureLeagues, data.league, isGraphicStateHydrated, visibleLeagueOptions])

  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const raw = window.localStorage.getItem(GRAPHIC_STATE_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedGraphicState> | null
        if (parsed && typeof parsed === "object") {
          const storedLeague =
            typeof parsed.league === "string" && parsed.league.trim() ? parsed.league : DEFAULT_DATA.league
          const storedLanguage = parsed.language === "pt-BR" ? "pt-BR" : "es"
          const storedSelectedLeagues = Array.isArray(parsed.selectedLeagues)
            ? parsed.selectedLeagues.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
            : []

          setData((current) => ({
            ...current,
            league: storedLeague,
            language: storedLanguage,
          }))
          setSelectedLeagues(sortPreviewLeagues(storedSelectedLeagues.length > 0 ? storedSelectedLeagues : [storedLeague]))
          setLeagueImages(toStringRecord(parsed.leagueImages))
          setLeagueTransforms(toTransformRecord(parsed.leagueTransforms))
          setLeagueLogoVariants(toBooleanRecord(parsed.leagueLogoVariants))
        }
      }
    } catch (error) {
      console.error("Error restoring saved graphic state", error)
    } finally {
      setIsGraphicStateHydrated(true)
    }
  }, [])

  // ── Global mouse handlers for image dragging ────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const dragState = dragRef.current
      if (!dragState) return
      const dx = (e.clientX - dragState.startX) / previewScale
      const dy = (e.clientY - dragState.startY) / previewScale
      setLeagueTransforms((prev) => ({
        ...prev,
        [data.league]: {
          ...(prev[data.league] ?? DEFAULT_IMAGE_TRANSFORM),
          x: dragState.startImgX + dx,
          y: dragState.startImgY + dy,
        },
      }))
    }
    const onUp = () => { dragRef.current = null }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup",   onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup",   onUp)
    }
  }, [data.league, previewScale])

  useEffect(() => {
    if (!isGraphicStateHydrated || typeof window === "undefined") return

    const payload: PersistedGraphicState = {
      version: 2,
      league: data.league,
      language: data.language,
      selectedLeagues,
      leagueImages,
      leagueTransforms,
      leagueLogoVariants,
    }

    try {
      window.localStorage.setItem(GRAPHIC_STATE_STORAGE_KEY, JSON.stringify(payload))
    } catch (error) {
      console.error("Error saving graphic state", error)
    }
  }, [data.language, data.league, isGraphicStateHydrated, leagueImages, leagueLogoVariants, leagueTransforms, selectedLeagues])

  const syncFromFixtures = useCallback(
    (showFeedback = false) => {
      const synced = buildGraphicDataFromFixtures({
        fixtures,
        timeZones,
        league: data.league,
        language: data.language,
      })

      if (!synced) {
        setData((d) => ({ ...d, rows: [] }))
        if (showFeedback) {
          setLoadMsg(`No hay partidos de "${data.league}" en el fixture actual.`)
          setTimeout(() => setLoadMsg(null), 3000)
        }
        return false
      }

      setData((d) => ({
        ...d,
        rows: synced.rows,
        title: synced.title || d.title,
        col1Label: synced.col1Label,
        col2Label: synced.col2Label,
        col3Label: synced.col3Label,
        showCol3: synced.showCol3,
        showTeamNames: false,
      }))

      if (showFeedback) {
        setLoadMsg(`✓ ${synced.rows.length} partidos cargados de ${data.league}`)
        setTimeout(() => setLoadMsg(null), 3000)
      }

      return true
    },
    [data.language, data.league, fixtures, timeZones],
  )

  // ── Auto-load fixtures when source data changes ────────────────────────────
  useEffect(() => {
    if (!isGraphicStateHydrated) return
    syncFromFixtures(false)
  }, [isGraphicStateHydrated, syncFromFixtures])

  // ── Data helpers ────────────────────────────────────────────────────────────
  const setField = <K extends keyof GfxData>(k: K, v: GfxData[K]) =>
    setData((d) => ({ ...d, [k]: v }))

  // ── Manual load from fixture button ────────────────────────────────────────
  const loadFromFixtures = useCallback(() => {
    syncFromFixtures(true)
  }, [syncFromFixtures])

  const loadEntireFixture = useCallback(() => {
    if (allFixtureLeagues.length === 0) {
      setLoadMsg("No hay ligas cargadas en el fixture actual.")
      setTimeout(() => setLoadMsg(null), 3000)
      return
    }

    setSelectedLeagues(sortPreviewLeagues(allFixtureLeagues))
    setLoadMsg(`✓ ${allFixtureLeagues.length} ligas cargadas desde el fixture actual`)
    setTimeout(() => setLoadMsg(null), 3000)
  }, [allFixtureLeagues])

  const loadOnlyCurrentLeague = useCallback(() => {
    setSelectedLeagues([data.league])
    setLoadMsg(`✓ Vista limitada a ${data.league}`)
    setTimeout(() => setLoadMsg(null), 3000)
  }, [data.league])

  const addLeagueToPreview = useCallback(() => {
    setSelectedLeagues((prev) => (prev.includes(data.league) ? prev : [...prev, data.league]))
  }, [data.league])

  const removeLeagueFromPreview = useCallback((league: string) => {
    setSelectedLeagues((prev) => {
      const next = prev.filter((item) => item !== league)
      return next.length > 0 ? next : [data.league]
    })
  }, [data.league])

  const moveLeagueToEnd = useCallback((league: string) => {
    setSelectedLeagues((prev) => {
      if (!prev.includes(league)) return prev
      const next = prev.filter((item) => item !== league)
      next.push(league)
      return next
    })
  }, [])

  const moveLeagueRelative = useCallback((league: string, targetLeague: string, position: "before" | "after") => {
    setSelectedLeagues((prev) => {
      const fromIndex = prev.indexOf(league)
      const targetIndex = prev.indexOf(targetLeague)
      if (fromIndex < 0 || targetIndex < 0 || league === targetLeague) return prev

      const next = prev.filter((item) => item !== league)
      const adjustedTargetIndex = next.indexOf(targetLeague)
      if (adjustedTargetIndex < 0) return prev

      const insertIndex = position === "after" ? adjustedTargetIndex + 1 : adjustedTargetIndex
      next.splice(insertIndex, 0, league)
      return next
    })
  }, [])

  // ── Image upload ────────────────────────────────────────────────────────────
  const handleMainImage = useCallback(async (file: File) => {
    const b64 = await fileToBase64(file)
    setLeagueImages((prev) => ({ ...prev, [data.league]: b64 }))
    setLeagueTransforms((prev) => ({ ...prev, [data.league]: DEFAULT_IMAGE_TRANSFORM }))
  }, [data.league])

  const openMainImagePicker = useCallback(() => {
    mainInputRef.current?.click()
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    e.stopPropagation()
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith("image/")) handleMainImage(file)
  }, [handleMainImage])

  const onPreviewDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "copy"
    setIsDragging(true)
  }, [])

  const onPreviewDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  // ── Image pan/zoom interaction ──────────────────────────────────────────────
  const onImgMouseDown = (e: React.MouseEvent) => {
    if (!activeMainImage) return
    e.preventDefault()
    dragRef.current = {
      startX:    e.clientX,
      startY:    e.clientY,
      startImgX: activeImgTransform.x,
      startImgY: activeImgTransform.y,
    }
  }

  const onImgWheel = (e: React.WheelEvent) => {
    if (!activeMainImage) return
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.08 : 0.08
    setLeagueTransforms((prev) => {
      const current = prev[data.league] ?? DEFAULT_IMAGE_TRANSFORM
      return {
        ...prev,
        [data.league]: { ...current, scale: Math.max(0.3, Math.min(5, current.scale + delta)) },
      }
    })
  }

  const zoomBy = (delta: number) =>
    setLeagueTransforms((prev) => {
      const current = prev[data.league] ?? DEFAULT_IMAGE_TRANSFORM
      return {
        ...prev,
        [data.league]: { ...current, scale: Math.max(0.3, Math.min(5, current.scale + delta)) },
      }
    })

  const resetTransform = () =>
    setLeagueTransforms((prev) => ({ ...prev, [data.league]: DEFAULT_IMAGE_TRANSFORM }))

  // ── Export SVG source ──────────────────────────────────────────────────────
  const buildGraphicSvgString = useCallback(async (): Promise<string | null> => {
    if (graphicSections.length === 0) return null
    await document.fonts.ready
    const assetCache = new Map<string, string>()
    const requireInlineDataUrl = async (src: string) => {
      const dataUrl = await fetchAssetAsDataUrl(src, assetCache)
      if (!dataUrl.startsWith("data:")) {
        throw new Error(`No se pudo incrustar el recurso ${src}`)
      }
      return dataUrl
    }

    const [poppins400, poppins700] = await Promise.all([
      requireInlineDataUrl(SVG_EXPORT_POPPINS_400_URL),
      requireInlineDataUrl(SVG_EXPORT_POPPINS_700_URL),
    ])

    const defs: string[] = []
    const fontDefs = [
      `@font-face{font-family:'Poppins';font-style:normal;font-weight:400;font-display:block;src:url(${poppins400}) format('woff2')}`,
      `@font-face{font-family:'Poppins';font-style:normal;font-weight:700;font-display:block;src:url(${poppins700}) format('woff2')}`,
    ]

    const renderMultilineText = (
      lines: string[],
      centerX: number,
      startY: number,
      fontSize: number,
      color: string,
      weight: number,
      lineHeight = 1.02,
    ) => {
      const firstBaseline = startY
      return `<text x="${centerX}" y="${firstBaseline}" text-anchor="middle" fill="${color}" ${SVG_EXPORT_TEXT_ATTRS} font-size="${fontSize}" font-weight="${weight}">${
        lines.map((line, index) => `<tspan x="${centerX}" dy="${index === 0 ? 0 : fontSize * lineHeight}">${escapeSvgText(line)}</tspan>`).join("")
      }</text>`
    }

    const renderSection = async (section: GraphicSection, index: number) => {
      const sectionY = index * (CANVAS_H + COMPOSITE_SECTION_GAP)
      const { data: sectionData, theme, imageTransform, layoutMode } = section
      const assets = getLeagueAssets(sectionData.league)
      const rowCount = Math.max(1, sectionData.rows.length)
      const dateBreakCount = sectionData.rows.reduce((count, row) => count + (row.dateHeader ? 1 : 0), 0)
      const centerShortLayouts = rowCount <= 4
      const bottomPadding = BOTTOM_PADDING
      const sidePadding = RIGHT_SIDE_PADDING
      const rowGap = sectionData.rows.length > 1 ? (centerShortLayouts ? 12 : rowCount === 5 ? 8 : ROW_GAP) : 0
      const fiveMatchDateGap = rowCount === 5 ? 0 : rowGap
      const shortInterDateGap = centerShortLayouts ? 0 : rowGap
      const titleDateHeight = centerShortLayouts ? 28 : rowCount === 5 ? 26 : INLINE_DATE_HEIGHT
      const rowDateHeight = centerShortLayouts ? 28 : rowCount === 5 ? 26 : INLINE_DATE_HEIGHT
      const rowDateFontSize = INLINE_DATE_FONT_SIZE
      const shortDateTextOffset = centerShortLayouts ? Math.round(rowDateHeight * 0.5) : 0
      const topDateHeight = sectionData.title ? titleDateHeight : 0
      const rowH = centerShortLayouts
        ? 152
        : Math.floor(
            (CANVAS_H - bottomPadding - rowGap * Math.max(0, rowCount - 1) - rowDateHeight * dateBreakCount - topDateHeight) / rowCount,
          )
      const useShortSizing = rowCount <= 4
      const isCompactTeamsLayout = layoutMode === "teams" && useShortSizing
      const renderTeamsLayout = layoutMode === "teams" || sectionData.showTeamNames
      const effectiveRowH = useShortSizing ? Math.min(rowH, 150) : Math.min(rowH, REFERENCE_ROW_HEIGHT)
      const maxContentHeight = Math.max(72, effectiveRowH - 4)
      const bandHeight = useShortSizing
        ? Math.min(101, maxContentHeight)
        : Math.min(clamp(Math.floor(effectiveRowH * 0.78), 70, Math.min(118, maxContentHeight)))
      const isFiveMatchLayout = rowCount === 5
      const baseLogoBoxSize = useShortSizing
        ? clamp(Math.ceil(132 * 1.1), 96, Math.min(174, maxContentHeight))
        : clamp(Math.ceil(bandHeight * (isFiveMatchLayout ? 1.65 : 1.32) * 1.1), 90, Math.min(174, maxContentHeight))
      const svgLogoBoxScale = 1.104
      const fiveMatchLogoBoxBoost = isFiveMatchLayout ? 1.2 : 1
      const fiveMatchLogoBoxMax = Math.min(240, maxContentHeight * 1.3)
      const fiveMatchLogoBoxWidthScale = 0.972
      const fiveMatchLogoBoxHeightScale = 0.847875
      const fiveMatchRawLogoBoxSize = isFiveMatchLayout
        ? clamp(Math.ceil(bandHeight * 1.65 * 1.1 * 1.118 * svgLogoBoxScale * fiveMatchLogoBoxBoost), 90, fiveMatchLogoBoxMax)
        : baseLogoBoxSize
      const finalLogoBoxSize = isFiveMatchLayout
        ? Math.max(90, Math.round(fiveMatchRawLogoBoxSize * fiveMatchLogoBoxWidthScale))
        : fiveMatchRawLogoBoxSize
      const finalLogoBoxHeight = isFiveMatchLayout
        ? Math.max(90, Math.round(fiveMatchRawLogoBoxSize * fiveMatchLogoBoxHeightScale))
        : baseLogoBoxSize
      const logoSize = Math.floor(Math.min(finalLogoBoxSize, finalLogoBoxHeight) * (isFiveMatchLayout ? 0.88 * 1.15 * 0.95 : 0.8))
      const labelFz = REFERENCE_LABEL_FONT_SIZE
      const timeFz = REFERENCE_TIME_FONT_SIZE
      const bandNameFz = isCompactTeamsLayout ? 27 : clamp(Math.floor(bandHeight * 0.32), 24, 42)
      const centeredTimeFz = REFERENCE_TIME_FONT_SIZE
      const leagueLogoHeight = 134
      const leagueLogoMaxWidth = 224
      const contentWidth = RIGHT_W - sidePadding * 2
      const rowBoxX = LEFT_W + sidePadding
      const bandX = rowBoxX + finalLogoBoxSize
      const bandWidth = contentWidth - finalLogoBoxSize * 2
      const awayBoxX = LEFT_W + RIGHT_W - sidePadding - finalLogoBoxSize
      const sectionClipId = `section-clip-${index}`
      const leftClipId = `left-clip-${index}`
      const rightBandGradientId = `band-gradient-${index}`

      defs.push(`<clipPath id="${sectionClipId}"><rect x="0" y="${sectionY}" width="${CANVAS_W}" height="${CANVAS_H}" rx="${CANVAS_RADIUS}" ry="${CANVAS_RADIUS}" /></clipPath>`)
      defs.push(`<clipPath id="${leftClipId}"><rect x="0" y="${sectionY}" width="${LEFT_W}" height="${CANVAS_H}" /></clipPath>`)

      const bandGradient = typeof theme.bandBackground === "string" && theme.bandBackground.startsWith("linear-gradient(")
        ? parseSvgLinearGradient(theme.bandBackground, rightBandGradientId)
        : null
      if (bandGradient) defs.push(bandGradient.def)
      const bandFill = bandGradient ? bandGradient.fill : theme.bandBackground

      const [
        leagueLogoHref,
        rightBackgroundHref,
        leftMainImageHref,
        ...rowLogoHrefs
      ] = await Promise.all([
        fetchAssetAsDataUrl(assets.logo, assetCache),
        fetchAssetAsDataUrl(assets.background, assetCache),
        fetchAssetAsDataUrl(sectionData.mainImage, assetCache),
        ...sectionData.rows.flatMap((row) => [
          fetchAssetAsDataUrl(row.homeTeamLogo, assetCache),
          fetchAssetAsDataUrl(row.awayTeamLogo, assetCache),
        ]),
      ])

      const logoPairAt = (rowIndex: number) => ({
        home: rowLogoHrefs[rowIndex * 2] ?? "",
        away: rowLogoHrefs[rowIndex * 2 + 1] ?? "",
      })

      const sectionHeights: number[] = []
      if (sectionData.title) {
        sectionHeights.push(topDateHeight, centerShortLayouts ? shortInterDateGap : rowGap)
      }
      sectionData.rows.forEach((row, rowIndex) => {
        if (row.dateHeader) {
          sectionHeights.push(rowDateHeight)
        }
        sectionHeights.push(rowH)
        const nextRow = sectionData.rows[rowIndex + 1]
        const gapAfterRow = nextRow
          ? centerShortLayouts && nextRow.dateHeader
            ? shortInterDateGap
            : rowCount === 5 && nextRow.dateHeader
              ? fiveMatchDateGap
              : rowGap
          : rowGap
        if (gapAfterRow > 0) {
          sectionHeights.push(gapAfterRow)
        }
      })
      const totalContentHeight = sectionHeights.reduce((sum, itemHeight) => sum + itemHeight, 0)
      let cursorY = centerShortLayouts ? sectionY + (CANVAS_H - totalContentHeight) / 2 : sectionY
      const rightCenterX = LEFT_W + RIGHT_W / 2

      let body = `<g clip-path="url(#${sectionClipId})">`
      body += `<rect x="0" y="${sectionY}" width="${CANVAS_W}" height="${CANVAS_H}" fill="#000000" />`
      body += `<rect x="0" y="${sectionY}" width="${LEFT_W}" height="${CANVAS_H}" fill="#050505" />`

      if (leftMainImageHref) {
        const leftCx = LEFT_W / 2
        const leftCy = sectionY + CANVAS_H / 2
        body += `<g clip-path="url(#${leftClipId})" transform="translate(${leftCx + imageTransform.x} ${leftCy + imageTransform.y}) scale(${imageTransform.scale}) translate(${-leftCx} ${-sectionY - CANVAS_H / 2})">`
        body += `<image x="0" y="${sectionY}" width="${LEFT_W}" height="${CANVAS_H}" preserveAspectRatio="xMidYMid meet" href="${leftMainImageHref}" xlink:href="${leftMainImageHref}" />`
        body += `</g>`
      }

      if (leagueLogoHref) {
        body += `<image x="24" y="${sectionY + 26}" width="${leagueLogoMaxWidth}" height="${leagueLogoHeight}" preserveAspectRatio="xMinYMin meet" href="${leagueLogoHref}" xlink:href="${leagueLogoHref}" />`
      }

      body += `<rect x="${LEFT_W}" y="${sectionY}" width="${RIGHT_W}" height="${CANVAS_H}" fill="${escapeSvgText(theme.dark)}" />`
      if (rightBackgroundHref) {
        body += `<image x="${LEFT_W}" y="${sectionY}" width="${RIGHT_W}" height="${CANVAS_H}" preserveAspectRatio="none" href="${rightBackgroundHref}" xlink:href="${rightBackgroundHref}" />`
      }

      const renderLogoBox = (x: number, y: number, href: string) => {
        let box = `<rect x="${x}" y="${y}" width="${finalLogoBoxSize}" height="${finalLogoBoxHeight}" fill="#ffffff" />`
        if (href) {
          box += `<image x="${x + (finalLogoBoxSize - logoSize) / 2}" y="${y + (finalLogoBoxHeight - logoSize) / 2}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet" href="${href}" xlink:href="${href}" />`
        } else {
          box += `<rect x="${x + (finalLogoBoxSize - logoSize) / 2}" y="${y + (finalLogoBoxHeight - logoSize) / 2}" width="${logoSize}" height="${logoSize}" rx="10" ry="10" fill="#e5e7eb" />`
        }
        return box
      }

      const renderDateText = (text: string, y: number, translateY: number, blockHeight: number, fontSize: number) =>
        `<text x="${rightCenterX}" y="${y + blockHeight / 2 + translateY}" text-anchor="middle" dominant-baseline="middle" fill="${theme.dateTextColor}" ${SVG_EXPORT_TEXT_ATTRS} font-size="${fontSize}" font-weight="700">${escapeSvgText(text)}</text>`

      if (sectionData.title) {
        body += renderDateText(sectionData.title, cursorY, centerShortLayouts ? shortDateTextOffset : 20, titleDateHeight, INLINE_DATE_FONT_SIZE)
        cursorY += titleDateHeight + (centerShortLayouts ? shortInterDateGap : rowGap)
      }

      sectionData.rows.forEach((row, rowIndex) => {
        if (row.dateHeader) {
          body += renderDateText(row.dateHeader, cursorY, centerShortLayouts ? shortDateTextOffset : 20, rowDateHeight, rowDateFontSize)
          cursorY += rowDateHeight + shortInterDateGap
        }

        const rowY = cursorY
        const boxY = rowY + (rowH - finalLogoBoxHeight) / 2
        const currentBandY = rowY + (rowH - bandHeight) / 2
        const logos = logoPairAt(rowIndex)

        body += renderLogoBox(rowBoxX, boxY, logos.home)
        body += renderLogoBox(awayBoxX, boxY, logos.away)
        body += `<rect x="${bandX}" y="${currentBandY}" width="${bandWidth}" height="${bandHeight}" fill="${bandFill}" />`

        if (renderTeamsLayout) {
          const segmentWidth = (bandWidth - 4) / 3
          const dividerColor = dividerSvgColor(theme.textColor)
          const nameLines = (name: string) => {
            return getTeamNameLines(name, renderTeamsLayout && rowCount <= 5, useShortSizing)
          }
          const homeLines = nameLines(row.homeTeam)
          const awayLines = nameLines(row.awayTeam)
          const homeCenterX = bandX + segmentWidth / 2
          const timeCenterX = bandX + segmentWidth + 2 + segmentWidth / 2
          const awayCenterX = bandX + (segmentWidth + 2) * 2 + segmentWidth / 2
          const compactTeamsNudge = Math.round(bandHeight * 0.05)
          const homeStartY = currentBandY + (
            isCompactTeamsLayout
              ? 34 + (homeLines.length === 1 && row.homeTeam.trim().length <= 12 ? 12 : 0) + 8 + compactTeamsNudge
              : bandHeight / 2 - bandHeight * 0.07 + getFiveMatchTeamNameNudge(row.homeTeam, bandHeight)
          )
          const awayStartY = currentBandY + (
            isCompactTeamsLayout
              ? 34 + (awayLines.length === 1 && row.awayTeam.trim().length <= 12 ? 12 : 0) + 8 + compactTeamsNudge
              : bandHeight / 2 - bandHeight * 0.07 + getFiveMatchTeamNameNudge(row.awayTeam, bandHeight)
          )
          const timeY = currentBandY + (
            isCompactTeamsLayout
              ? 74 - compactTeamsNudge
              : bandHeight / 2 + bandHeight * 0.25
          )

          body += `<rect x="${bandX + segmentWidth}" y="${currentBandY + bandHeight * 0.12}" width="2" height="${bandHeight * 0.76}" fill="${dividerColor}" />`
          body += `<rect x="${bandX + segmentWidth + 2 + segmentWidth}" y="${currentBandY + bandHeight * 0.12}" width="2" height="${bandHeight * 0.76}" fill="${dividerColor}" />`
          body += renderMultilineText(homeLines, homeCenterX, homeStartY, bandNameFz, theme.textColor, 400)
          body += renderMultilineText(awayLines, awayCenterX, awayStartY, bandNameFz, theme.textColor, 400)
          body += `<text x="${timeCenterX}" y="${timeY}" text-anchor="middle" dominant-baseline="${isCompactTeamsLayout ? "middle" : "middle"}" fill="${theme.textColor}" ${SVG_EXPORT_TEXT_ATTRS} font-size="${centeredTimeFz}" font-weight="700">${escapeSvgText(row.col2 || row.col1 || row.col3 || "--:--")}</text>`
        } else {
          const columns = [
            { label: sectionData.col1Label, value: row.col1 },
            { label: sectionData.col2Label, value: row.col2 },
            ...(sectionData.showCol3 ? [{ label: sectionData.col3Label, value: row.col3 }] : []),
          ]
          const colWidth = (bandWidth - (columns.length - 1) * 2) / columns.length
          const dividerColor = dividerSvgColor(theme.textColor)
          const shortLayoutTagY = centerShortLayouts ? 0.22 : 0
          const shortLayoutValueY = centerShortLayouts ? 0.78 : 0

          columns.forEach((column, columnIndex) => {
            const colX = bandX + columnIndex * (colWidth + 2)
            const centerX = colX + colWidth / 2
            const labelY = currentBandY + bandHeight * (isFiveMatchLayout ? 0.24 : centerShortLayouts ? shortLayoutTagY : 0.2)
            const valueY = currentBandY + bandHeight * (isFiveMatchLayout ? 0.84 : centerShortLayouts ? shortLayoutValueY : 0.68)
            body += `<text x="${centerX}" y="${labelY}" text-anchor="middle" dominant-baseline="middle" fill="${theme.textColor}" ${SVG_EXPORT_TEXT_ATTRS} font-size="${labelFz}" font-weight="400">${escapeSvgText(column.label.toUpperCase())}</text>`
            body += `<text x="${centerX}" y="${valueY}" text-anchor="middle" dominant-baseline="middle" fill="${theme.textColor}" ${SVG_EXPORT_TEXT_ATTRS} font-size="${timeFz}" font-weight="700">${escapeSvgText(column.value || "--:--")}</text>`
            if (columnIndex < columns.length - 1) {
              body += `<rect x="${colX + colWidth}" y="${currentBandY + bandHeight * 0.12}" width="2" height="${bandHeight * 0.76}" fill="${dividerColor}" />`
            }
          })
        }

        const nextRow = sectionData.rows[rowIndex + 1]
        const gapAfterRow = nextRow
          ? centerShortLayouts && nextRow.dateHeader
            ? shortInterDateGap
            : rowCount === 5 && nextRow.dateHeader
              ? fiveMatchDateGap
              : rowGap
          : rowGap
        cursorY += rowH + gapAfterRow
      })

      body += `</g>`
      return body
    }

    const bodies = await Promise.all(graphicSections.map((section, index) => renderSection(section, index)))
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="${CANVAS_W}" height="${compositeHeight}" viewBox="0 0 ${CANVAS_W} ${compositeHeight}">
  <defs><style>${fontDefs.join("")}</style>${defs.join("")}</defs>
  ${bodies.join("")}
</svg>`
  }, [compositeHeight, graphicSections])

  const exportPng = useCallback(async () => {
    setExporting("png")
    try {
      const svgStr = await buildGraphicSvgString()
      if (!svgStr) return
      const response = await fetch(`/api/gfx/export/png?width=${CANVAS_W}&height=${compositeHeight}`, {
        method: "POST",
        headers: {
          "Content-Type": "image/svg+xml;charset=utf-8",
        },
        body: svgStr,
      })

      if (!response.ok) {
        throw new Error(`PNG export failed with status ${response.status}`)
      }

      const pngBlob = await response.blob()
      const url = URL.createObjectURL(pngBlob)
      const link = document.createElement("a")
      link.href = url
      link.download = `fixture-${slugify(data.league)}-${Date.now()}.png`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch (err) {
      console.error("PNG export error", err)
      alert("Error al exportar PNG. Revisá la consola para más detalles.")
    } finally {
      setExporting(null)
    }
  }, [buildGraphicSvgString, compositeHeight, data.league])

  const exportSvg = useCallback(async () => {
    setExporting("svg")
    try {
      const svgStr = await buildGraphicSvgString()
      if (!svgStr) return
      const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `fixture-${slugify(data.league)}-${Date.now()}.svg`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch (err) {
      console.error("SVG export error", err)
      alert("Error al exportar SVG. Revisá la consola para más detalles.")
    } finally {
      setExporting(null)
    }
  }, [buildGraphicSvgString, data.league])

  const isDraggingImg = !!dragRef.current

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Full-width preview ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <LayoutTemplate className="h-5 w-5 text-primary" />
              <CardTitle>Gráficos</CardTitle>
              <span className="text-xs text-gray-400 font-normal">
                {CANVAS_W} × {CANVAS_H} px
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Zoom controls */}
              <div className="flex items-center gap-1 border rounded-lg px-2 py-1">
                <button type="button" onClick={() => zoomBy(-0.1)} className="text-gray-500 hover:text-gray-800 p-0.5">
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="text-xs font-mono w-10 text-center text-gray-600">
                  {Math.round(activeImgTransform.scale * 100)}%
                </span>
                <button type="button" onClick={() => zoomBy(0.1)} className="text-gray-500 hover:text-gray-800 p-0.5">
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={resetTransform} className="text-gray-400 hover:text-gray-700 p-0.5 ml-1" title="Resetear">
                  <Maximize2 className="h-3 w-3" />
                </button>
              </div>
              <Button size="sm" variant="outline" onClick={exportSvg} disabled={!!exporting}>
                <Download className="h-3.5 w-3.5 mr-1" />
                {exporting === "svg" ? "Exportando…" : "SVG"}
              </Button>
              <Button size="sm" onClick={exportPng} disabled={!!exporting}>
                <Download className="h-3.5 w-3.5 mr-1" />
                {exporting === "png" ? "Exportando…" : "PNG"}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Scaled preview container */}
          <div
            ref={previewContainerRef}
            className="relative w-full overflow-hidden rounded-b-lg bg-black select-none"
            style={{ height: Math.round(compositeHeight * previewScale), borderRadius: CANVAS_RADIUS }}
          >
            {/* Scaled canvas */}
            <div
              style={{
                width: CANVAS_W,
                height: compositeHeight,
                transform: `scale(${previewScale})`,
                transformOrigin: "top left",
                pointerEvents: "none",
              }}
            >
              <GfxCompositeCanvas sections={graphicSections} />
            </div>

            {/* Drag/zoom interaction overlay */}
            {activeMainImage ? (
              <div
                style={{
                  position: "absolute",
                  top: 0, left: 0,
                  width: Math.round(LEFT_W * previewScale),
                  height: Math.round(compositeHeight * previewScale),
                  cursor: dragRef.current ? "grabbing" : "grab",
                  zIndex: 10,
                }}
                onMouseDown={onImgMouseDown}
                onWheel={onImgWheel}
                onDragOver={onPreviewDragOver}
                onDragLeave={onPreviewDragLeave}
                onDrop={onDrop}
              />
            ) : (
              <button
                type="button"
                aria-label={`Agregar imagen a la zona negra de ${data.league}`}
                onClick={openMainImagePicker}
                onDragOver={onPreviewDragOver}
                onDragLeave={onPreviewDragLeave}
                onDrop={onDrop}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: Math.round(LEFT_W * previewScale),
                  height: Math.round(compositeHeight * previewScale),
                  zIndex: 10,
                  border: 0,
                  background: isDragging ? "rgba(255,255,255,0.03)" : "transparent",
                  color: "#fff",
                  cursor: "copy",
                  padding: 0,
                  margin: 0,
                  appearance: "none",
                  WebkitAppearance: "none",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 24,
                    boxSizing: "border-box",
                  }}
                >
                  <div
                    style={{
                      maxWidth: 300,
                      width: "100%",
                      borderRadius: 18,
                      border: `1px dashed ${isDragging ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.16)"}`,
                      background: "rgba(0,0,0,0.42)",
                      backdropFilter: "blur(6px)",
                      WebkitBackdropFilter: "blur(6px)",
                      padding: "18px 16px",
                      textAlign: "center",
                      boxShadow: "0 16px 40px rgba(0,0,0,0.25)",
                    }}
                  >
                    <Upload className="mx-auto h-8 w-8 text-white/70" />
                    <div style={{ marginTop: 10, fontSize: 16, fontWeight: 700, lineHeight: 1.15 }}>
                      Soltá la imagen en la zona negra
                    </div>
                    <div style={{ marginTop: 6, fontSize: 11, color: "rgba(255,255,255,0.72)", lineHeight: 1.35 }}>
                      O hacé click para elegir un archivo y luego ajustarlo con zoom.
                    </div>
                  </div>
                </div>
              </button>
            )}

            {/* Hint tooltip on left panel */}
            {activeMainImage && (
              <div style={{
                position: "absolute",
                bottom: 8, left: 8,
                background: "rgba(0,0,0,0.55)",
                color: "rgba(255,255,255,0.75)",
                fontSize: 10, padding: "3px 8px", borderRadius: 4,
                pointerEvents: "none", backdropFilter: "blur(4px)",
              }}>
                Arrastrá la foto · Scroll para zoom
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Controls — 3 columns ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Col 1: Liga + idioma + columnas + opciones */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Liga e Idioma</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Liga</Label>
                <Select value={data.league} onValueChange={(v) => setField("league", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {visibleLeagueOptions.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-gray-400 mt-1 font-mono">
                  {activeAssets.logo}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 h-8 text-xs"
                  onClick={addLeagueToPreview}
                  disabled={selectedLeagues.includes(data.league)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Agregar al preview
                </Button>
              </div>
              <div>
                <Label className="text-xs">Idioma</Label>
                <Select value={data.language} onValueChange={(v) => setField("language", v as GfxData["language"])}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="pt-BR">Português (BR)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Column labels */}
              <div className="pt-1 border-t">
                <Label className="text-xs text-gray-500 uppercase tracking-wide">Columnas de horario</Label>
                <div className={`grid gap-2 mt-2 ${data.showCol3 ? "grid-cols-3" : "grid-cols-2"}`}>
                  <div>
                    <Label className="text-[10px]">Col 1</Label>
                    <Input className="h-7 text-xs mt-0.5" value={data.col1Label}
                      onChange={(e) => setField("col1Label", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-[10px]">Col 2</Label>
                    <Input className="h-7 text-xs mt-0.5" value={data.col2Label}
                      onChange={(e) => setField("col2Label", e.target.value)} />
                  </div>
                  {data.showCol3 && (
                    <div>
                      <Label className="text-[10px]">Col 3</Label>
                      <Input className="h-7 text-xs mt-0.5" value={data.col3Label}
                        onChange={(e) => setField("col3Label", e.target.value)} />
                    </div>
                  )}
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-2 pt-1 border-t">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Mostrar Col 3</Label>
                  <Switch checked={data.showCol3} onCheckedChange={(v) => setField("showCol3", v)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Nombres de equipos</Label>
                  <Switch checked={data.showTeamNames} onCheckedChange={(v) => setField("showTeamNames", v)} />
                </div>
                {activeBaseAssets.whiteLogo && (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Label className="text-xs">Logo liga blanco</Label>
                      <p className="text-[10px] text-gray-400">
                        Usa la versión clara para esta liga.
                      </p>
                    </div>
                    <Switch
                      checked={activeUsesWhiteLogo}
                      onCheckedChange={(checked) => {
                        setLeagueLogoVariants((prev) => ({ ...prev, [data.league]: checked }))
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-1 border-t">
                <Label className="text-xs text-gray-500 uppercase tracking-wide">Orden del preview</Label>
                <p className="mt-0.5 text-[10px] text-gray-400">Arrastrá cada liga con la manija para reordenarla.</p>
                <div
                  className="space-y-1.5"
                  onDragOver={(e) => {
                    if (!draggedPreviewLeague) return
                    e.preventDefault()
                    e.dataTransfer.dropEffect = "move"
                    setPreviewDropTarget(null)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    const sourceLeague = draggedPreviewLeague ?? e.dataTransfer.getData("text/plain")
                    if (!sourceLeague) return
                    moveLeagueToEnd(sourceLeague)
                    setDraggedPreviewLeague(null)
                    setPreviewDropTarget(null)
                  }}
                >
                  {selectedLeagues.map((league, index) => (
                    <div
                      key={`${league}-${index}`}
                      className={`relative flex items-center gap-2 rounded-md border bg-slate-50 px-2 py-1.5 transition-colors ${
                        draggedPreviewLeague === league ? "opacity-50" : ""
                      } ${
                        previewDropTarget?.league === league
                          ? "border-primary/50 bg-primary/5"
                          : ""
                      }`}
                      onDragOver={(e) => {
                        if (!draggedPreviewLeague || draggedPreviewLeague === league) return
                        e.preventDefault()
                        e.stopPropagation()
                        e.dataTransfer.dropEffect = "move"
                        const rect = e.currentTarget.getBoundingClientRect()
                        const position = e.clientY < rect.top + rect.height / 2 ? "before" : "after"
                        setPreviewDropTarget({ league, position })
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const sourceLeague = draggedPreviewLeague ?? e.dataTransfer.getData("text/plain")
                        if (!sourceLeague || sourceLeague === league) {
                          setDraggedPreviewLeague(null)
                          setPreviewDropTarget(null)
                          return
                        }

                        const rect = e.currentTarget.getBoundingClientRect()
                        const position = e.clientY < rect.top + rect.height / 2 ? "before" : "after"
                        moveLeagueRelative(sourceLeague, league, position)
                        setDraggedPreviewLeague(null)
                        setPreviewDropTarget(null)
                      }}
                    >
                      {previewDropTarget?.league === league && previewDropTarget.position === "before" && (
                        <div className="absolute left-2 right-2 top-0 h-0.5 rounded-full bg-primary" />
                      )}
                      {previewDropTarget?.league === league && previewDropTarget.position === "after" && (
                        <div className="absolute left-2 right-2 bottom-0 h-0.5 rounded-full bg-primary" />
                      )}
                      <button
                        type="button"
                        draggable={selectedLeagues.length > 1}
                        className="cursor-grab touch-none text-slate-400 hover:text-slate-700 active:cursor-grabbing disabled:cursor-default disabled:opacity-30"
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move"
                          e.dataTransfer.setData("text/plain", league)
                          setDraggedPreviewLeague(league)
                          setPreviewDropTarget(null)
                        }}
                        onDragEnd={() => {
                          setDraggedPreviewLeague(null)
                          setPreviewDropTarget(null)
                        }}
                        title="Arrastrar para reordenar"
                        aria-label={`Arrastrar ${league}`}
                        disabled={selectedLeagues.length <= 1}
                      >
                        <GripVertical className="h-4 w-4" />
                      </button>
                      <div className="min-w-0 flex-1 truncate text-xs font-medium">{league}</div>
                      <button
                        type="button"
                        className="text-slate-400 hover:text-red-600 disabled:opacity-30"
                        onClick={() => removeLeagueFromPreview(league)}
                        disabled={selectedLeagues.length === 1}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Col 2: Imagen principal */}
        <div>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Imagen de {data.league}</CardTitle>
              <CardDescription className="text-xs">
                Cada liga guarda su propia imagen. Podés soltarla en la zona negra, hacer click ahí o usar este selector, y luego ajustar zoom solo para la liga seleccionada.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={() => mainInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-lg cursor-pointer transition-colors flex flex-col items-center justify-center gap-2 ${
                  isDragging ? "border-primary bg-primary/5" : "border-gray-300 hover:border-primary/60 hover:bg-gray-50"
                }`}
                style={{ minHeight: 160 }}
              >
                {activeMainImage ? (
                  <img src={activeMainImage} className="w-full h-44 object-contain rounded-md bg-slate-100" alt="preview" />
                ) : (
                  <>
                    <Upload className="h-10 w-10 text-gray-300" />
                    <span className="text-sm text-gray-400 text-center px-4">
                      Arrastrá una imagen o hacé click
                    </span>
                  </>
                )}
                {activeMainImage && (
                  <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm font-medium">Cambiar imagen</span>
                  </div>
                )}
              </div>
              <input ref={mainInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleMainImage(f) }} />
              {activeMainImage && (
                <Button variant="ghost" size="sm" className="w-full text-xs text-red-500 hover:text-red-700"
                  onClick={() => {
                    setLeagueImages((prev) => {
                      const next = { ...prev }
                      delete next[data.league]
                      return next
                    })
                    setLeagueTransforms((prev) => {
                      const next = { ...prev }
                      delete next[data.league]
                      return next
                    })
                  }}>
                  Quitar imagen
                </Button>
              )}

              {/* Title */}
              <div className="pt-1 border-t">
                <Label className="text-xs">Título / Fecha del gráfico</Label>
                <Input
                  className="mt-1"
                  value={data.title}
                  onChange={(e) => setField("title", e.target.value)}
                  placeholder={data.language === "pt-BR" ? "Sexta-feira, 10 de abril" : "Viernes 10 de abril"}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Col 3: Partidos */}
        <div>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Partidos</CardTitle>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  data.rows.length === 0 ? "bg-slate-100 text-slate-700"
                  : data.rows.length <= 3 ? "bg-green-100 text-green-800"
                  : data.rows.length === 4 ? "bg-blue-100 text-blue-800"
                  : "bg-orange-100 text-orange-800"
                }`}>
                  {data.rows.length} {data.rows.length === 1 ? "partido" : "partidos"}
                </span>
              </div>
	              <div className="mt-2">
	                <Button variant="outline" size="sm" className="w-full border-primary/40 text-primary hover:bg-primary/5"
	                  onClick={loadFromFixtures}>
	                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
	                  Sincronizar con {data.league}
	                </Button>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={loadEntireFixture}
                    >
                      Ver todo
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={loadOnlyCurrentLeague}
                    >
                      Solo esta liga
                    </Button>
                  </div>
	                {loadMsg && (
	                  <p className="text-xs text-center text-green-700 font-medium mt-1">{loadMsg}</p>
	                )}
	              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.rows.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
                  No hay partidos de {data.league} cargados en el fixture actual.
                </div>
	              ) : (
	                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
	                  <p className="font-medium">
                      {graphicSections.length > 1
                        ? `${graphicSections.length} bloques listos para descarga.`
                        : `${data.rows.length} partidos sincronizados desde Fixtures.`}
                    </p>
	                  <p className="mt-1 text-xs text-slate-500">
	                    Este módulo usa directamente los partidos de la pestaña principal.
	                  </p>
	                </div>
	              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Asset info */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="py-3 px-4 text-xs text-amber-700">
          <strong>Assets de liga activa ({data.league}):</strong>{" "}
          <code className="bg-amber-100 px-1 rounded">public{activeAssets.logo}</code>
          {" · "}
          <code className="bg-amber-100 px-1 rounded">public{activeAssets.background}</code>
          <details className="mt-1">
            <summary className="cursor-pointer">Ver todos los nombres →</summary>
            <div className="mt-1 font-mono grid grid-cols-2 gap-x-4">
              {LEAGUES.map((l) => {
                const assets = getLeagueAssets(l)
                return (
                  <span key={l}>
                    {l} → <strong>{assets.logo.replace("/gfx/logos/", "")}</strong>
                  </span>
                )
              })}
            </div>
          </details>
        </CardContent>
      </Card>

    </div>
  )
}
